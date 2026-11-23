import { requireUser } from "@/lib/auth";
import { NameForm } from "./NameForm";
import { PasswordForm } from "./PasswordForm";
import { AppSettings } from "./AppSettings";
import { vapidPublicKey } from "@/lib/push";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-sm space-y-10">
      <div>
        <h1 className="font-display text-3xl font-black">A minha conta</h1>
        <p className="mt-1 text-muted">
          {user.name} · @{user.username}
          {user.is_admin && " · admin"}
        </p>
      </div>
      <section>
        <h2 className="mb-3 font-display text-xl font-black">Nome no jornal</h2>
        <NameForm name={user.name} />
      </section>
      <section>
        <h2 className="mb-3 font-display text-xl font-black">Password</h2>
        <PasswordForm />
      </section>
      <section id="app">
        <h2 className="mb-3 font-display text-xl font-black">App e notificações</h2>
        <AppSettings vapidKey={vapidPublicKey()} />
      </section>
    </div>
  );
}
