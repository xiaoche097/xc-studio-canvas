import React from 'react';

// --- UI Icons ---
export const SendIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="19" x2="12" y2="5"></line>
    <polyline points="5 12 12 5 19 12"></polyline>
  </svg>
);

export const UploadIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

export const RobotIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ED6D46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><line x1="12" y1="7" x2="12" y2="11"/>
  </svg>
);

export const UserIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

export const RefreshIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

export const CheckIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export const SparklesIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
  </svg>
);

export const SettingsIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

export const ArrowUpIcon = ({ className }: { className?: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
  </svg>
);

export const ImageIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
  </svg>
);

export const SunIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

export const MoonIcon = ({ className }: { className?: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

export const DownloadIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

export const ZoomIcon = ({ className }: { className?: string }) => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
     <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
   </svg>
);

// --- New Icons to Match Agent Roles ---

export const VisualGuidelinesIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/>
  </svg>
);

export const StrategyIcon = ({ className }: { className?: string }) => (
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>
  </svg>
);

export const CopyIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
  </svg>
);

export const ProductionIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
);

export const PackageIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

// --- Feature Visuals (Illustrative Style) ---
// These are designed to "bleed" off the edge of the cards

export const ModelVisual = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 20C55 20 58 24 58 28V35H42V28C42 24 45 20 50 20Z" fill="currentColor" fillOpacity="0.2"/>
    <path d="M42 35H58L65 85H35L42 35Z" fill="currentColor" fillOpacity="0.2"/>
    <circle cx="50" cy="15" r="8" stroke="currentColor" strokeWidth="2"/>
    <path d="M30 40L42 35V85L30 90V40Z" stroke="currentColor" strokeWidth="2"/>
    <path d="M70 40L58 35V85L70 90V40Z" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

export const MarketingVisual = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="25" y="40" width="50" height="40" rx="4" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1"/>
    <path d="M25 40L50 60L75 40" stroke="currentColor" strokeWidth="2"/>
    <path d="M50 20V40" stroke="currentColor" strokeWidth="2"/>
    <path d="M50 40H20" stroke="currentColor" strokeWidth="2"/>
    <circle cx="50" cy="20" r="10" stroke="currentColor" strokeWidth="2"/>
    <path d="M75 25L85 35" stroke="currentColor" strokeWidth="2"/>
    <path d="M15 25L25 35" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

export const BackgroundVisual = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 70L40 40L60 70" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1"/>
    <path d="M50 70L70 50L90 70" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1"/>
    <circle cx="30" cy="30" r="8" stroke="currentColor" strokeWidth="2"/>
    <rect x="10" y="70" width="80" height="10" fill="currentColor" fillOpacity="0.2"/>
  </svg>
);

export const AmazonSelectionVisual = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="20" width="60" height="60" rx="4" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1"/>
    <path d="M30 65L45 50L60 60L80 40" stroke="currentColor" strokeWidth="2"/>
    <circle cx="30" cy="65" r="3" fill="currentColor"/>
    <circle cx="45" cy="50" r="3" fill="currentColor"/>
    <circle cx="60" cy="60" r="3" fill="currentColor"/>
    <circle cx="80" cy="40" r="3" fill="currentColor"/>
    <path d="M70 20V30" stroke="currentColor" strokeWidth="2"/>
    <path d="M30 20V30" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

export const TranslateVisual = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="20" width="40" height="50" rx="4" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1"/>
    <rect x="40" y="40" width="40" height="50" rx="4" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1"/>
    <text x="30" y="45" fontSize="12" fill="currentColor">A</text>
    <text x="60" y="70" fontSize="12" fill="currentColor">B</text>
    <path d="M30 60L50 60" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

export const VideoVisual = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* 左侧小耳朵 */}
    <path d="M 31 54 C 25 54, 23 61, 29 64 C 31 65, 33 63, 33 60" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

    {/* 圆鼓鼓的大脸颊与下巴 */}
    <path d="M 33 60 C 35 72, 51 78, 67 78 C 83 78, 95 66, 93 50" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

    {/* 风间标志性发型 */}
    <path d="M 33 46 C 26 44, 13 37, 7 35 C 17 27, 35 15, 43 9 C 49 9, 55 21, 59 25 C 65 17, 73 14, 77 19 C 81 23, 79 27, 85 27 C 89 19, 95 14, 97 21 C 99 27, 97 37, 91 45 C 87 41, 81 39, 75 42 C 67 37, 59 37, 53 43 C 45 39, 37 41, 33 46 Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

    {/* 刘海分界线 */}
    <path d="M 33 46 C 39 42, 47 40, 55 44 C 61 38, 69 38, 77 43 C 83 40, 89 42, 93 46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

    {/* 圆圆黑黑的呆萌大眼睛 */}
    <ellipse cx="50" cy="51" rx="8" ry="10" fill="currentColor" fillOpacity="0.9" stroke="currentColor" strokeWidth="2" />
    <ellipse cx="74" cy="49" rx="8" ry="10" fill="currentColor" fillOpacity="0.9" stroke="currentColor" strokeWidth="2" />

    {/* 高高挂起的小细眉毛 */}
    <path d="M 40 37 Q 48 33, 54 39" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M 68 39 Q 74 33, 82 37" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />

    {/* 小巧的鼻子 */}
    <path d="M 68 57 L 66 62" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

    {/* 标志性偏向右脸颊的可爱小嘴巴 */}
    <path d="M 67 66 C 65 62, 77 62, 75 66 C 74 72, 66 72, 67 66 Z" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

    {/* 衣服身体 */}
    <path d="M 45 78 C 36 82, 29 88, 29 96 C 29 102, 35 104, 42 102 C 44 110, 77 110, 79 102 C 85 104, 91 102, 91 96 C 91 88, 85 82, 77 78 Z" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

    {/* 衣服领子与线条 */}
    <path d="M 45 78 C 53 82, 69 82, 77 78" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M 57 82 V 86 M 61 83 V 87 M 65 82 V 86" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />

    {/* 握成小馒头状的右手 */}
    <path d="M 41 102 C 43 102, 47 98, 47 94 C 47 90, 41 88, 37 92 C 33 96, 37 102, 41 102 Z" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M 41 92 C 43 94, 43 96, 41 98" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />

    {/* 右手臂袖子 */}
    <path d="M 77 82 C 85 82, 93 84, 99 88 L 95 96 C 89 92, 83 90, 77 90 Z" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />

    {/* 萌萌的小手指着右方 */}
    <path d="M 97 88 C 99 84, 103 77, 106 78 C 109 79, 107 86, 103 87 C 109 85, 115 84, 118 87 C 120 89, 116 92, 109 94 C 111 94, 113 96, 112 98 C 111 100, 107 100, 105 98 C 104 98, 99 98, 97 94 Z" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

    {/* 可爱的肥短裤 */}
    <path d="M 43 102 L 39 111 L 57 111 L 58 107 L 60 111 L 79 111 L 75 102 Z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

    {/* 短胖的小左腿与白鞋袜 */}
    <path d="M 45 111 V 115" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <rect x="43" y="115" width="5" height="3" fill="#FFFFFF" fillOpacity="0.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M 43 118 C 39 118, 37 121, 44 121 L 48 121 Z" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

    {/* 短胖的小右腿与白鞋袜 */}
    <path d="M 73 111 V 115" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <rect x="71" y="115" width="5" height="3" fill="#FFFFFF" fillOpacity="0.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M 73 118 C 77 118, 79 121, 72 121 L 68 121 Z" fill="currentColor" fillOpacity="0.05" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const CreativeVisual = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="40" r="15" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1"/>
    <path d="M50 55V65" stroke="currentColor" strokeWidth="2"/>
    <path d="M45 65H55" stroke="currentColor" strokeWidth="2"/>
    <path d="M30 20L35 28" stroke="currentColor" strokeWidth="2"/>
    <path d="M70 20L65 28" stroke="currentColor" strokeWidth="2"/>
    <path d="M50 15V20" stroke="currentColor" strokeWidth="2"/>
    <path d="M20 40H28" stroke="currentColor" strokeWidth="2"/>
    <path d="M80 40H72" stroke="currentColor" strokeWidth="2"/>
  </svg>
);