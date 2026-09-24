import nairobiSkyline from "@/assets/nairobi-skyline.jpg";
import { LoginForm } from "./components/login-form";

export default function LoginPage() {
  return (
    <div
      className="relative flex min-h-svh flex-col items-center justify-center p-6 md:p-10 bg-cover bg-center"
      style={{ backgroundImage: `url(${nairobiSkyline})` }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
