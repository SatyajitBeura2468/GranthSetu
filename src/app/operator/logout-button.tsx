import { logoutAction } from "@/app/operator/actions";

export function LogoutButton() {
  return <form action={logoutAction}><button className="button button-quiet" type="submit">Sign out</button></form>;
}
