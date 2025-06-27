'use client';

import { Button } from '@/components/ui/button';
import { Settings, Youtube } from 'lucide-react';

interface HeaderProps {
  onOpenApiDialog: () => void;
}

export function Header() {
  return (
    <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Youtube className="w-8 h-8 text-red-500" />
          <h1 className="text-2xl font-bold text-white">Youtubeboost</h1>
        </div>
        
        <Button
          variant="outline"
          size="sm"
         
          className="border-white/20 text-white  bg-black hover:bg-white/10"
        >
          <Settings className="w-4 h-4 mr-2" />
          API Keys
        </Button>
      </div>
    </header>
  );
}