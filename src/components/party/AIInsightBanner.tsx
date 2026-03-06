import React from 'react';
import { Sparkles } from 'lucide-react';

interface AIInsightBannerProps {
  text: string;
}

const AIInsightBanner: React.FC<AIInsightBannerProps> = ({ text }) => {
  return (
    <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-yellow-50 p-5 my-8 shadow-sm">
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-yellow-400" />
      <div className="flex items-start gap-4 pl-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-1">
            AI Insight
          </h4>
          <p className="text-gray-700 text-sm leading-relaxed">
            {text}
          </p>
        </div>
      </div>
      <div className="absolute -top-8 -right-8 w-24 h-24 bg-yellow-200 rounded-full opacity-20 blur-xl" />
      <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-blue-200 rounded-full opacity-20 blur-lg" />
    </div>
  );
};

export default AIInsightBanner;
