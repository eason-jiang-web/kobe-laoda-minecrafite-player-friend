import { Hero } from "@/sections/01-Hero";
import { Clips } from "@/sections/02-Clips";
import { About } from "@/sections/03-About";
import { Points } from "@/sections/05-Points";
import { WorksWith } from "@/sections/07-WorksWith";
import { Closing } from "@/sections/08-Closing";

export default function Home() {
  return (
    <main>
      <Hero />
      <Clips />
      <About />
      <Points />
      <WorksWith />
      <Closing />
    </main>
  );
}
