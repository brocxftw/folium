import { type FormEvent, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

export function NavbarSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [draft, setDraft] = useState(() =>
    location.pathname === "/search" ? (params.get("q") ?? "") : "",
  );

  useEffect(() => {
    if (location.pathname === "/search") {
      setDraft(params.get("q") ?? "");
    }
  }, [location.pathname, params]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    const next = new URLSearchParams();
    if (trimmed) next.set("q", trimmed);
    const query = next.toString();
    navigate(query ? `/search?${query}` : "/search");
  };

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="relative w-[clamp(280px,28vw,340px)] shrink-0 lg:w-[clamp(320px,28vw,500px)]"
    >
      <Search
        className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-[#CBD5E1]"
        aria-hidden="true"
      />
      <input
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Search documents, tags, folders..."
        aria-label="Search documents, tags, folders"
        className="h-[52px] w-full rounded-[10px] border border-[rgba(148,163,184,0.22)] bg-[rgba(30,41,59,0.72)] py-0 pr-4 pl-12 text-sm font-normal text-[#F8FAFC] shadow-[inset_0_1px_1px_rgba(255,255,255,0.025),0_2px_8px_rgba(2,6,23,0.10)] transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-[#94A3B8] outline-none focus-visible:border-[rgba(45,212,191,0.65)] focus-visible:shadow-[0_0_0_3px_rgba(20,184,166,0.10)] focus-visible:outline-none"
      />
    </form>
  );
}
