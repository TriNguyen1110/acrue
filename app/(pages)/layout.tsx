import Sidebar from "@/components/stateful/Sidebar";

export default function PagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-navy-900">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="px-8 py-4 text-center text-[11px]" style={{ color: "rgba(247,243,229,0.25)" }}>
          A Product By{" "}
          <a
            href="https://www.linkedin.com/in/tri-nguyen-524395253/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-gold-400 transition-colors"
          >
            Tri Nguyen
          </a>
        </footer>
      </div>
    </div>
  );
}
