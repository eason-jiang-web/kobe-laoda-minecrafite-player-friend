import { Hero } from "@/sections/01-Hero";
import { Clips } from "@/sections/02-Clips";
import { About } from "@/sections/03-About";
import { Banner } from "@/sections/04-Banner";
import { Points } from "@/sections/05-Points";
import { Works } from "@/sections/06-Works";
import { WorksWith } from "@/sections/07-WorksWith";
import { Closing } from "@/sections/08-Closing";

export default function Home() {
  return (
    <main>
      <Hero />
      <Clips />
      <About />
      <Banner />
      <Points />
      <Works />
      <WorksWith />
      <Closing />
    </main>
  );
}
