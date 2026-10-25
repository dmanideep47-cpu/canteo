import { useState } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import LineupSection from './components/LineupSection';
import PrinciplesSection from './components/PrinciplesSection';
import ShowcaseSection from './components/ShowcaseSection';
import CtaFooter from './components/CtaFooter';
import CaseStudyModal from './components/CaseStudyModal';

export default function LandingPage({ onNavigateToApp }) {
  const [isCaseStudyOpen, setIsCaseStudyOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#111111] selection:bg-[#D97706] selection:text-white font-body">
      {/* Top Editorial Nav */}
      <Navbar onLaunchPrototype={() => onNavigateToApp('menu')} />

      {/* Main Content: Exactly 5 Sections */}
      <main>
        {/* Section 01 — Hero */}
        <HeroSection
          onLaunchPrototype={() => onNavigateToApp('menu')}
          onOpenCaseStudy={() => setIsCaseStudyOpen(true)}
        />

        {/* Section 02 — The Lineup */}
        <LineupSection
          onSelectTab={(tabKey) => onNavigateToApp(tabKey)}
        />

        {/* Section 03 — Principles */}
        <PrinciplesSection />

        {/* Section 04 — Showcase */}
        <ShowcaseSection />
      </main>

      {/* Section 05 — Footer CTA */}
      <CtaFooter onLaunchPrototype={() => onNavigateToApp('menu')} />

      {/* Case Study Modal */}
      <CaseStudyModal
        isOpen={isCaseStudyOpen}
        onClose={() => setIsCaseStudyOpen(false)}
        onLaunchPrototype={() => onNavigateToApp('menu')}
      />
    </div>
  );
}
