import nairobiSkyline from "@/assets/nairobi-skyline.jpg";
import { ForgotPasswordForm } from "./components/forgot-password-form";

export default function ForgotPassword3Page() {
  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-4 bg-cover bg-center"
      style={{ backgroundImage: `url(${nairobiSkyline})` }}
    >
      <div className="absolute inset-0 bg-black/50" />
      <ForgotPasswordForm className="relative z-10 w-full max-w-sm md:max-w-4xl" />
    </div>
  );
}
