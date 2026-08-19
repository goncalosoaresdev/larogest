"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (result.error) {
      setError("Email ou palavra-passe incorrectos.");
      return;
    }
    router.push(searchParams.get("next") || "/leads");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormField label="Email">
        <Input name="email" type="email" required autoComplete="email" defaultValue="admin@laro.pt" />
      </FormField>
      <FormField label="Palavra-passe">
        <Input name="password" type="password" required autoComplete="current-password" />
      </FormField>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "A entrar…" : "Entrar"}
      </Button>
    </form>
  );
}
