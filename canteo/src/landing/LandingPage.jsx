import { useState } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import LineupSection from './components/LineupSection';
import PrinciplesSection from './components/PrinciplesSection';
import ShowcaseSection from './components/ShowcaseSection';
import CtaFooter from './components/CtaFooter';
import CaseStudyModal from './components/CaseStudyModal';

export default function LandingPage({ onNavigateToApp, onEnterApp }) {
  const [isCaseStudyOpen, setIsCaseStudyOpen] = useState(false);
  const handleNavigate = onNavigateToApp || onEnterApp || ((tab = 'menu') => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/app?tab=${tab}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  });

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#111111] selection:bg-[#D97706] selection:text-white font-body">
      {/* Top Editorial Nav */}
      <Navbar onLaunchPrototype={() => handleNavigate('menu')} />

      {/* Main Content: Exactly 5 Sections */}
      <main>
        {/* Section 01 — Hero */}
        <HeroSection
          onLaunchPrototype={() => handleNavigate('menu')}
          onOpenCaseStudy={() => setIsCaseStudyOpen(true)}
        />

        {/* Section 02 — The Lineup */}
        <LineupSection
          onSelectTab={(tabKey) => handleNavigate(tabKey)}
        />

        {/* Section 03 — Principles */}
        <PrinciplesSection />

        {/* Section 04 — Showcase */}
        <ShowcaseSection />
      </main>

      {/* Section 05 — Footer CTA */}
      <CtaFooter onLaunchPrototype={() => handleNavigate('menu')} />

      {/* Case Study Modal */}
      <CaseStudyModal
        isOpen={isCaseStudyOpen}
        onClose={() => setIsCaseStudyOpen(false)}
        onLaunchPrototype={() => handleNavigate('menu')}
      />
    </div>
  );
}
