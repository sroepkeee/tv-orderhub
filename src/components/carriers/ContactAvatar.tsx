interface ContactAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const avatarColors = [
  'bg-purple-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-amber-500',
];

const getAvatarColor = (name: string): string => {
  const charCode = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColors[charCode % avatarColors.length];
};

const getInitials = (name: string): string => {
  const words = name.trim().split(' ').filter(w => w.length > 0);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

export function ContactAvatar({ name, size = 'md', className = '' }: ContactAvatarProps) {
  const initials = getInitials(name);
  const colorClass = getAvatarColor(name);
  
  return (
    <div 
      className={`${sizeClasses[size]} ${colorClass} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
}
