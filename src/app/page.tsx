import "@/styles/vertex.css";
import { CustomCursor } from "@/components/vertex/custom-cursor";
import { VertexNavbar } from "@/components/vertex/vertex-navbar";
import { HeroScene } from "@/components/vertex/hero-scene";
import { FeaturesSection } from "@/components/vertex/features-section";
import { MathQuiz } from "@/components/vertex/math-quiz";
import { Grapher } from "@/components/vertex/grapher";
import { VertexFooter } from "@/components/vertex/vertex-footer";

export default function LandingPage() {
  return (
    <div className="vertex-page">
      <CustomCursor />
      <VertexNavbar />
      <HeroScene />
      <FeaturesSection />
      <Grapher />
      <MathQuiz />
      <VertexFooter />
    </div>
  );
}
