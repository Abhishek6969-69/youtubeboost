'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Sparkles, Target, TrendingUp, Zap } from 'lucide-react';

export function GeneratedFeatureCards({
  tit,
  des,
  icon,
}: {
  tit: string;
  des: any;
  icon: React.ReactNode;
}) {
 

  return (
    <div className=" gap-4 ">
      <Card className="p-6 h-[320px] bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all duration-300">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2">{icon}</div>
          <CardTitle className="text-white text-lg">{tit}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-gray-300 text-center">
            {des}
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
