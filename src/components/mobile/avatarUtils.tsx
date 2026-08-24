import React from 'react';

// Generates consistent avatar illustration SVG or stylized colors based on user email
export const getAvatarGradient = (email: string) => {
  const hash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradients = [
    'from-violet-500 to-indigo-600',
    'from-rose-400 to-pink-600',
    'from-amber-400 to-orange-500',
    'from-emerald-400 to-teal-600',
    'from-sky-400 to-blue-600',
    'from-purple-500 to-fuchsia-600',
  ];
  return gradients[hash % gradients.length];
};

export const getInitials = (name: string) => {
  if (!name) return 'MC';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// SVG 3D-styled user avatar component
export const UserAvatar: React.FC<{
  name: string;
  email: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  className?: string;
  showCameraBadge?: boolean;
  onCameraClick?: () => void;
}> = ({
  name,
  email,
  size = 'md',
  isOnline = true,
  className = '',
  showCameraBadge = false,
  onCameraClick,
}) => {
  const initials = getInitials(name);
  const gradient = getAvatarGradient(email);

  const sizeClasses = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-10 h-10 text-xs',
    lg: 'w-14 h-14 text-base font-bold',
    xl: 'w-24 h-24 text-2xl font-bold',
  };

  const statusDotSizes = {
    sm: 'w-2 h-2 -top-0.5 -right-0.5',
    md: 'w-2.5 h-2.5 top-0 right-0 border-2 border-white',
    lg: 'w-3.5 h-3.5 top-0.5 right-0.5 border-2 border-white',
    xl: 'w-5 h-5 top-1 right-1 border-3 border-white',
  };

  return (
    <div className={`relative inline-block select-none ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-full bg-gradient-to-tr ${gradient} text-white flex items-center justify-center font-bold shadow-xs tracking-wider border-2 border-white/80 overflow-hidden`}
      >
        <span className="drop-shadow-xs">{initials}</span>
      </div>

      {isOnline && !showCameraBadge && (
        <span
          className={`absolute ${statusDotSizes[size]} bg-emerald-500 rounded-full shadow-xs ring-1 ring-emerald-400/40`}
          title="Online"
        />
      )}

      {showCameraBadge && (
        <button
          type="button"
          onClick={onCameraClick}
          className="absolute -bottom-1 -right-1 w-7 h-7 bg-slate-800/90 hover:bg-slate-900 text-white rounded-full flex items-center justify-center border-2 border-white shadow-md cursor-pointer transition"
          title="Edit Avatar"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      )}
    </div>
  );
};
