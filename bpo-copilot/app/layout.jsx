import "./globals.css";

export const metadata = {
  title: "BPO Copilot",
  description: "Auto-drafted broker price opinions — address in, reviewed BPO out.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav style={{ display: "flex", gap: 18, alignItems: "center", padding: "10px 16px", background: "#fff", borderBottom: "1px solid #dde3e7", fontFamily: "ui-sans-serif, system-ui, sans-serif", fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: "#0e5a4a" }}>BPO Copilot</span>
          <a href="/" style={{ textDecoration: "none", color: "#5c6b76", fontWeight: 600 }}>Generator</a>
          <a href="/engine" style={{ textDecoration: "none", color: "#5c6b76", fontWeight: 600 }}>Adjustment engine</a>
          <a href="/mls" style={{ textDecoration: "none", color: "#5c6b76", fontWeight: 600 }}>Connect MLS</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
