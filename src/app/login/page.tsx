import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-bold">企業內部訂餐暨飲料系統 - 後台登入</h1>
      <LoginForm />
    </main>
  );
}
