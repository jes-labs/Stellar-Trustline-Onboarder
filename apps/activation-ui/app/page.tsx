export default function Home() {
  return (
    <main style={{ maxWidth: 520, padding: 32, textAlign: 'center' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Welcome to Stellar</h1>
      <p style={{ opacity: 0.8, lineHeight: 1.5 }}>
        This is the themeable activation page (stub). It will connect a wallet, sponsor the reserve,
        create and authorize the trustline or claim the balance, then return you to the referring
        platform.
      </p>
      <p style={{ opacity: 0.5, fontSize: 13, marginTop: 24 }}>
        Phase 2 deliverable — wiring for mechanisms C and A is not implemented yet.
      </p>
    </main>
  );
}
