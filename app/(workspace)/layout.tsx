export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background lg:h-screen lg:overflow-hidden">
      {children}
    </div>
  );
}