import { AuthForm } from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <div className="flex flex-1 flex-col bg-cream">
      <AuthForm mode="register" />
    </div>
  );
}
