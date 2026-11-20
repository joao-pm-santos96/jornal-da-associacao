import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="font-display text-3xl font-black">Só para sócios</h1>
      <p className="mb-6 mt-1 text-muted">Mostra o cartão de imprensa para entrar.</p>
      <LoginForm />
    </div>
  );
}
