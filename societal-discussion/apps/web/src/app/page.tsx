import { redirect } from 'next/navigation';

// This app is the researchers' admin. The participant pages are the Astro
// app on their own host; the root only leads to the admin.
export default function RootPage() {
  redirect('/admin');
}
