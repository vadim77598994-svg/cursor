export default function GalleryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]" style={{ backgroundColor: "#0a0a0a" }}>
      {children}
    </div>
  );
}
