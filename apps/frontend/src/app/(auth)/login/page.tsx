"use client";

import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLogin } from "../../../hooks/useAuth";
import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import { isAxiosError } from "axios";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { mutate: login, isPending, error } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const apiError =
    error && isAxiosError(error)
      ? (error.response?.data as any)?.message ?? "Login failed"
      : null;

  return (
    <div className="w-full max-w-md">
      {/* Card */}
      <div className="rounded-2xl bg-white shadow-xl p-8">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Image
            src="/logo.jpeg"
            alt="CertifyBusiness logo"
            width={72}
            height={72}
            className="mx-auto rounded-xl mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900">CertifyBusiness</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
        </div>

        {/* Error */}
        {apiError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit((d) => login(d))} className="space-y-5">
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            required
            error={errors.email?.message}
            {...register("email")}
          />

          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            error={errors.password?.message}
            {...register("password")}
          />

          <Button type="submit" className="w-full" loading={isPending}>
            Sign in
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} CertifyBusiness. All rights reserved.
      </p>
    </div>
  );
}
