-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view profiles" 
  ON public.profiles FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = id);

CREATE POLICY "Superadmins can manage all profiles" 
  ON public.profiles FOR ALL 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'superadmin'));

-- Initialize profiles for existing users using their email as default name
INSERT INTO public.profiles (id, full_name)
SELECT id, split_part(email, '@', 1)
FROM auth.users
ON CONFLICT DO NOTHING;
