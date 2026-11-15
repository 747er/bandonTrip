import { redirect } from "next/navigation";
import { TRIP } from "@/data/trip";

// bandontrip.com opens straight onto the trip.
export default function FrontDoor() {
  redirect(`/t/${TRIP.slug}`);
}
