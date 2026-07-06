import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col bg-cream">
      <AuthForm mode="login" />
    </div>
  );
}
