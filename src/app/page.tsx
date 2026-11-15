import { redirect } from "next/navigation";
import { TRIP } from "@/data/trip";

// bandontrip.com opens straight onto the trip. Choosing a name happens there, on a sheet.
export default function FrontDoor() {
  redirect(`/t/${TRIP.slug}`);
}
