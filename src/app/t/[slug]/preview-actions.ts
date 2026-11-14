"use server";

import { revalidatePath } from "next/cache";
import { setPreviewAt } from "@/lib/auth";

export async function exitPreview() {
  await setPreviewAt(null);
  revalidatePath("/t", "layout");
}
