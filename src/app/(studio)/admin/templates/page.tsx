"use client";

import { AdminTemplateStudio } from "@/components/AdminTemplateStudio";
import { hydrateRegistryFromStorage } from "@/lib/registry-storage";
import { useEffect } from "react";

export default function AdminTemplatesPage() {
  useEffect(() => {
    hydrateRegistryFromStorage();
  }, []);

  return <AdminTemplateStudio />;
}
