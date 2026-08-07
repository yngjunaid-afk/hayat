import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  "https://hwwwryddbqmvmudrizaw.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3d3dyeWRkYnFtdm11ZHJpemF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwODcxNzAsImV4cCI6MjA5ODY2MzE3MH0.3vWC661RY_NvyfVjDhtglpn6CwS94u0YEfkKF4WffYQ";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);