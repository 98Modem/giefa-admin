"use client";

import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  useRef,
  useTransition,
} from "react";
import { showSystemToast } from "@/app/components/feedback/SystemToast";

type ActionFormProps = Omit<
  ComponentPropsWithoutRef<"form">,
  "action" | "children"
> & {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  successTitle: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
};

export function ActionForm({
  action,
  children,
  successTitle,
  successMessage,
  resetOnSuccess = false,
  ...formProps
}: ActionFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      {...formProps}
      ref={formRef}
      aria-busy={isPending}
      data-action-pending={isPending ? "true" : "false"}
      action={(formData) => {
        startTransition(async () => {
          await action(formData);
          if (resetOnSuccess) formRef.current?.reset();
          showSystemToast({
            title: successTitle,
            message: successMessage,
            tone: "success",
          });
        });
      }}
    >
      {children}
    </form>
  );
}
