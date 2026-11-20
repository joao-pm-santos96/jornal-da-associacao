import { requireUser } from "@/lib/auth";
import { PasswordForm } from "./PasswordForm";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="font-display text-3xl font-black">A minha conta</h1>
      <p className="mb-6 mt-1 text-muted">
        {user.name} · @{user.username}
        {user.is_admin && " · admin"}
      </p>
      <PasswordForm />
    </div>
  );
}
