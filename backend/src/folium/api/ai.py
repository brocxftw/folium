"""AI provider, policy, usage, and suggestion endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from folium.ai.profiles import PROFILE_PRESETS
from folium.ai.registry import get_adapter
from folium.ai.url_validation import validate_provider_base_url
from folium.api.schemas import (
    AIPolicyOut,
    AIPolicyUpdate,
    AIProviderCreate,
    AIProviderOut,
    AIProviderUpdate,
    AIUsageSummary,
    MessageOut,
    SuggestionOut,
)
from folium.auth.deps import AdminUser, CurrentUser, SafeSession
from folium.bootstrap import ensure_ai_settings
from folium.core.exceptions import ConflictError, NotFoundError, ValidationError
from folium.core.security import decrypt_secret, encrypt_secret, mask_secret
from folium.db.session import get_db
from folium.models import (
    AIProfileName,
    AIProvider,
    AISettings,
    AISuggestion,
    Correspondent,
    Document,
    DocumentType,
    PrivacyMode,
    ProviderKind,
    SuggestionStatus,
    Tag,
)
from folium.services import documents as doc_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


def _provider_out(provider: AIProvider) -> AIProviderOut:
    has_key = provider.encrypted_api_key is not None
    masked: str | None = None
    if has_key:
        try:
            masked = mask_secret(decrypt_secret(provider.encrypted_api_key))  # type: ignore[arg-type]
        except ValueError:
            masked = "••••"
    return AIProviderOut(
        id=provider.id,
        name=provider.name,
        kind=provider.kind.value,
        base_url=provider.base_url,
        has_api_key=has_key,
        api_key_masked=masked,
        is_local=provider.is_local,
        enabled=provider.enabled,
        chat_model=provider.chat_model,
        embedding_model=provider.embedding_model,
        vision_model=provider.vision_model,
        context_window=provider.context_window,
        max_output_tokens=provider.max_output_tokens,
        supports_tools=provider.supports_tools,
        supports_vision=provider.supports_vision,
        supports_structured_output=provider.supports_structured_output,
        supports_embeddings=provider.supports_embeddings,
        no_training=provider.no_training,
        zero_retention=provider.zero_retention,
    )


def _policy_out(settings_row: AISettings) -> AIPolicyOut:
    return AIPolicyOut(
        privacy_mode=settings_row.privacy_mode.value,
        profile=settings_row.profile.value,
        chat_provider_id=settings_row.chat_provider_id,
        embedding_provider_id=settings_row.embedding_provider_id,
        vision_provider_id=settings_row.vision_provider_id,
        allow_remote_embeddings=settings_row.allow_remote_embeddings,
        allow_remote_qa=settings_row.allow_remote_qa,
        allow_remote_vision=settings_row.allow_remote_vision,
        warn_before_remote=settings_row.warn_before_remote,
        block_remote_ai=settings_row.block_remote_ai,
        auto_enrichment=settings_row.auto_enrichment,
        auto_tagging=settings_row.auto_tagging,
        retrieved_chunks=settings_row.retrieved_chunks,
        max_context_tokens=settings_row.max_context_tokens,
        max_output_tokens=settings_row.max_output_tokens,
        conversation_history_tokens=settings_row.conversation_history_tokens,
        parallel_llm_calls=settings_row.parallel_llm_calls,
        active_embedding_provider=settings_row.active_embedding_provider,
        active_embedding_model=settings_row.active_embedding_model,
        active_embedding_dimension=settings_row.active_embedding_dimension,
    )


def _kind_from_str(kind: str) -> ProviderKind:
    try:
        return ProviderKind(kind)
    except ValueError as exc:
        raise ValidationError(f"Unsupported provider kind: {kind}") from exc


# ---- Providers ----


@router.get("/providers", response_model=list[AIProviderOut])
async def list_providers(
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[AIProviderOut]:
    providers = (await db.execute(select(AIProvider).order_by(AIProvider.name))).scalars().all()
    return [_provider_out(p) for p in providers]


@router.post("/providers", response_model=AIProviderOut, status_code=201)
async def create_provider(
    body: AIProviderCreate,
    _sess: SafeSession,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AIProviderOut:
    existing = (
        await db.execute(select(AIProvider).where(AIProvider.name == body.name))
    ).scalar_one_or_none()
    if existing:
        raise ConflictError("Provider name already exists")

    validated = validate_provider_base_url(body.base_url)
    provider = AIProvider(
        name=body.name,
        kind=_kind_from_str(body.kind),
        base_url=validated.url,
        is_local=body.is_local or validated.is_local,
        chat_model=body.chat_model,
        embedding_model=body.embedding_model,
        vision_model=body.vision_model,
        context_window=body.context_window,
        max_output_tokens=body.max_output_tokens,
        supports_tools=body.supports_tools,
        supports_vision=body.supports_vision,
        supports_structured_output=body.supports_structured_output,
        supports_embeddings=body.supports_embeddings,
        no_training=body.no_training,
        zero_retention=body.zero_retention,
    )
    if body.api_key:
        provider.encrypted_api_key = encrypt_secret(body.api_key)
    db.add(provider)
    await db.flush()
    return _provider_out(provider)


@router.get("/providers/{provider_id}", response_model=AIProviderOut)
async def get_provider(
    provider_id: uuid.UUID,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AIProviderOut:
    provider = await db.get(AIProvider, provider_id)
    if provider is None:
        raise NotFoundError("Provider not found")
    return _provider_out(provider)


@router.patch("/providers/{provider_id}", response_model=AIProviderOut)
async def update_provider(
    provider_id: uuid.UUID,
    body: AIProviderUpdate,
    _sess: SafeSession,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AIProviderOut:
    provider = await db.get(AIProvider, provider_id)
    if provider is None:
        raise NotFoundError("Provider not found")

    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        conflict = (
            await db.execute(
                select(AIProvider).where(
                    AIProvider.name == data["name"],
                    AIProvider.id != provider_id,
                )
            )
        ).scalar_one_or_none()
        if conflict:
            raise ConflictError("Provider name already exists")
        provider.name = data["name"]

    if "base_url" in data and data["base_url"] is not None:
        validated = validate_provider_base_url(data["base_url"])
        provider.base_url = validated.url
        if body.is_local is None:
            provider.is_local = validated.is_local

    for field in (
        "is_local",
        "enabled",
        "chat_model",
        "embedding_model",
        "vision_model",
        "context_window",
        "max_output_tokens",
        "supports_tools",
        "supports_vision",
        "supports_structured_output",
        "supports_embeddings",
        "no_training",
        "zero_retention",
    ):
        if field in data and data[field] is not None:
            setattr(provider, field, data[field])

    if body.clear_api_key:
        provider.encrypted_api_key = None
    elif body.api_key:
        provider.encrypted_api_key = encrypt_secret(body.api_key)

    await db.flush()
    return _provider_out(provider)


@router.delete("/providers/{provider_id}", response_model=MessageOut)
async def delete_provider(
    provider_id: uuid.UUID,
    _sess: SafeSession,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageOut:
    provider = await db.get(AIProvider, provider_id)
    if provider is None:
        raise NotFoundError("Provider not found")
    await db.delete(provider)
    return MessageOut(message="Provider deleted")


@router.post("/providers/{provider_id}/test", response_model=MessageOut)
async def test_provider_connection(
    provider_id: uuid.UUID,
    _sess: SafeSession,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageOut:
    provider = await db.get(AIProvider, provider_id)
    if provider is None:
        raise NotFoundError("Provider not found")
    adapter = get_adapter(provider)
    try:
        ok = await adapter.test_connection()
    finally:
        await adapter.aclose()
    if not ok:
        raise ValidationError("Provider connection test failed")
    return MessageOut(message="Connection successful")


# ---- Policy ----


@router.get("/policy", response_model=AIPolicyOut)
async def get_policy(
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AIPolicyOut:
    settings_row = await ensure_ai_settings(db)
    return _policy_out(settings_row)


@router.patch("/policy", response_model=AIPolicyOut)
async def update_policy(
    body: AIPolicyUpdate,
    _sess: SafeSession,
    _admin: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AIPolicyOut:
    settings_row = await ensure_ai_settings(db)
    data = body.model_dump(exclude_unset=True)

    if "privacy_mode" in data and data["privacy_mode"] is not None:
        settings_row.privacy_mode = PrivacyMode(data["privacy_mode"])
    if "profile" in data and data["profile"] is not None:
        settings_row.profile = AIProfileName(data["profile"])
        if settings_row.profile != AIProfileName.CUSTOM:
            preset = PROFILE_PRESETS[settings_row.profile.value]
            settings_row.retrieved_chunks = preset["retrieved_chunks"]
            settings_row.max_context_tokens = preset["max_context_tokens"]
            settings_row.max_output_tokens = preset["max_output_tokens"]
            settings_row.conversation_history_tokens = preset["conversation_history_tokens"]
            settings_row.parallel_llm_calls = preset["parallel_llm_calls"]

    for field in (
        "chat_provider_id",
        "embedding_provider_id",
        "vision_provider_id",
        "allow_remote_embeddings",
        "allow_remote_qa",
        "allow_remote_vision",
        "warn_before_remote",
        "block_remote_ai",
        "auto_enrichment",
        "auto_tagging",
        "retrieved_chunks",
        "max_context_tokens",
        "max_output_tokens",
        "conversation_history_tokens",
        "parallel_llm_calls",
    ):
        if field in data and data[field] is not None:
            setattr(settings_row, field, data[field])

    if settings_row.profile != AIProfileName.CUSTOM and any(
        f in data
        for f in (
            "retrieved_chunks",
            "max_context_tokens",
            "max_output_tokens",
            "conversation_history_tokens",
            "parallel_llm_calls",
        )
    ):
        settings_row.profile = AIProfileName.CUSTOM

    if settings_row.embedding_provider_id is not None:
        embed_provider = await db.get(AIProvider, settings_row.embedding_provider_id)
        if embed_provider is not None:
            settings_row.active_embedding_provider = embed_provider.name
            settings_row.active_embedding_model = embed_provider.embedding_model

    await db.flush()
    return _policy_out(settings_row)


# ---- Usage ----


@router.get("/usage", response_model=AIUsageSummary)
async def get_usage(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AIUsageSummary:
    from folium.models import AIUsage

    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = today_start.replace(day=1)

    async def _aggregate(since: datetime) -> dict[str, Any]:
        row = (
            await db.execute(
                select(
                    func.count(AIUsage.id),
                    func.coalesce(func.sum(AIUsage.input_tokens), 0),
                    func.coalesce(func.sum(AIUsage.output_tokens), 0),
                    func.coalesce(func.sum(AIUsage.estimated_cost), 0.0),
                ).where(
                    AIUsage.user_id == _user.id,
                    AIUsage.created_at >= since,
                )
            )
        ).one()
        return {
            "requests": int(row[0]),
            "input_tokens": int(row[1]),
            "output_tokens": int(row[2]),
            "estimated_cost": float(row[3]),
        }

    by_provider_rows = (
        await db.execute(
            select(
                AIUsage.provider,
                func.count(AIUsage.id),
                func.coalesce(func.sum(AIUsage.input_tokens), 0),
                func.coalesce(func.sum(AIUsage.output_tokens), 0),
            )
            .where(
                AIUsage.user_id == _user.id,
                AIUsage.created_at >= month_start,
            )
            .group_by(AIUsage.provider)
            .order_by(func.count(AIUsage.id).desc())
        )
    ).all()

    by_model_rows = (
        await db.execute(
            select(
                AIUsage.model,
                func.count(AIUsage.id),
                func.coalesce(func.sum(AIUsage.input_tokens), 0),
            )
            .where(
                AIUsage.user_id == _user.id,
                AIUsage.created_at >= month_start,
            )
            .group_by(AIUsage.model)
            .order_by(func.count(AIUsage.id).desc())
            .limit(20)
        )
    ).all()

    by_operation_rows = (
        await db.execute(
            select(
                AIUsage.operation,
                func.count(AIUsage.id),
            )
            .where(
                AIUsage.user_id == _user.id,
                AIUsage.created_at >= month_start,
            )
            .group_by(AIUsage.operation)
            .order_by(func.count(AIUsage.id).desc())
        )
    ).all()

    return AIUsageSummary(
        today=await _aggregate(today_start),
        this_month=await _aggregate(month_start),
        by_provider=[
            {
                "provider": r[0],
                "requests": int(r[1]),
                "input_tokens": int(r[2]),
                "output_tokens": int(r[3]),
            }
            for r in by_provider_rows
        ],
        by_model=[
            {"model": r[0], "requests": int(r[1]), "input_tokens": int(r[2])} for r in by_model_rows
        ],
        by_operation=[{"operation": r[0], "requests": int(r[1])} for r in by_operation_rows],
    )


# ---- Suggestions ----


@router.get("/suggestions", response_model=list[SuggestionOut])
async def list_suggestions(
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    document_id: uuid.UUID | None = None,
    status: SuggestionStatus | None = SuggestionStatus.PENDING,
) -> list[SuggestionOut]:
    stmt = (
        select(AISuggestion)
        .join(Document, Document.id == AISuggestion.document_id)
        .where(Document.owner_id == _user.id)
        .order_by(AISuggestion.created_at.desc())
    )
    if document_id is not None:
        stmt = stmt.where(AISuggestion.document_id == document_id)
    if status is not None:
        stmt = stmt.where(AISuggestion.status == status)
    rows = (await db.execute(stmt.limit(200))).scalars().all()
    return [
        SuggestionOut(
            id=s.id,
            document_id=s.document_id,
            field=s.field,
            value=s.value,
            status=s.status.value,
            provider=s.provider,
            model=s.model,
            confidence=s.confidence,
        )
        for s in rows
    ]


async def _apply_suggestion(
    db: AsyncSession,
    suggestion: AISuggestion,
    owner_id: uuid.UUID,
) -> None:
    doc = await doc_service.get_document(db, suggestion.document_id, owner_id=owner_id)
    field = suggestion.field
    value = suggestion.value

    if field == "title" and "title" in value:
        doc.title = str(value["title"])
    elif field == "folder":
        # Intent only while in Inbox — never create folders here.
        if "folder_id" in value and value["folder_id"]:
            folder_id = uuid.UUID(str(value["folder_id"]))
            await doc_service.move_document(
                db,
                doc.id,
                folder_id,
                owner_id=owner_id,
                preserve_inbox=True if doc.inbox else False,
            )
            doc_service.set_pending_folder_path(doc, None)
            if doc.inbox:
                doc.needs_review = False
        elif value.get("create") and value.get("path"):
            doc_service.set_pending_folder_path(doc, str(value["path"]))
            if doc.inbox:
                doc.needs_review = False
        elif value.get("path") and value.get("exists"):
            # Path claimed to exist but no id — store as pending for Process resolution
            doc_service.set_pending_folder_path(doc, str(value["path"]))
            if doc.inbox:
                doc.needs_review = False
    elif field == "document_type" and "document_type_id" in value:
        type_id = uuid.UUID(str(value["document_type_id"]))
        document_type = await db.get(DocumentType, type_id)
        if document_type is None or document_type.owner_id != owner_id:
            raise NotFoundError("Document type not found")
        doc.document_type_id = type_id
    elif field == "correspondent" and "correspondent_id" in value:
        correspondent_id = uuid.UUID(str(value["correspondent_id"]))
        correspondent = await db.get(Correspondent, correspondent_id)
        if correspondent is None or correspondent.owner_id != owner_id:
            raise NotFoundError("Correspondent not found")
        doc.correspondent_id = correspondent_id
    elif field == "tags" and "tag_names" in value:
        names = value["tag_names"]
        if isinstance(names, list):
            from folium.core.exceptions import ConflictError
            from folium.services import tags as tag_service

            resolved: list[Tag] = []
            for raw in names:
                if not isinstance(raw, str) or not raw.strip():
                    continue
                name = raw.strip()
                existing = (
                    await db.execute(
                        select(Tag).where(
                            Tag.owner_id == owner_id,
                            Tag.name.ilike(name),
                        )
                    )
                ).scalar_one_or_none()
                if existing is not None:
                    resolved.append(existing)
                    continue
                try:
                    created = await tag_service.create_tag(
                        db, name=name, owner_id=owner_id
                    )
                    resolved.append(created)
                except ConflictError:
                    again = (
                        await db.execute(
                            select(Tag).where(
                                Tag.owner_id == owner_id,
                                Tag.name.ilike(name),
                            )
                        )
                    ).scalar_one_or_none()
                    if again is not None:
                        resolved.append(again)
            if resolved:
                existing_ids = {t.id for t in doc.tags}
                doc.tags = list(doc.tags) + [t for t in resolved if t.id not in existing_ids]
    elif field == "notes" and "notes" in value:
        doc.notes = str(value["notes"])
    await db.flush()


@router.post("/suggestions/{suggestion_id}/accept", response_model=SuggestionOut)
async def accept_suggestion(
    suggestion_id: uuid.UUID,
    _sess: SafeSession,
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SuggestionOut:
    suggestion = await db.get(AISuggestion, suggestion_id)
    if suggestion is None:
        raise NotFoundError("Suggestion not found")
    await doc_service.get_document(db, suggestion.document_id, owner_id=_user.id)
    await _apply_suggestion(db, suggestion, _user.id)
    suggestion.status = SuggestionStatus.ACCEPTED
    await db.flush()
    return SuggestionOut(
        id=suggestion.id,
        document_id=suggestion.document_id,
        field=suggestion.field,
        value=suggestion.value,
        status=suggestion.status.value,
        provider=suggestion.provider,
        model=suggestion.model,
        confidence=suggestion.confidence,
    )


@router.post("/suggestions/{suggestion_id}/reject", response_model=SuggestionOut)
async def reject_suggestion(
    suggestion_id: uuid.UUID,
    _sess: SafeSession,
    _user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SuggestionOut:
    suggestion = await db.get(AISuggestion, suggestion_id)
    if suggestion is None:
        raise NotFoundError("Suggestion not found")
    await doc_service.get_document(db, suggestion.document_id, owner_id=_user.id)
    suggestion.status = SuggestionStatus.REJECTED
    await db.flush()
    return SuggestionOut(
        id=suggestion.id,
        document_id=suggestion.document_id,
        field=suggestion.field,
        value=suggestion.value,
        status=suggestion.status.value,
        provider=suggestion.provider,
        model=suggestion.model,
        confidence=suggestion.confidence,
    )
