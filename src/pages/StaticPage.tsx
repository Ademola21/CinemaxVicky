import React, { useEffect } from 'react';
import BackButton from '../components/BackButton';
import { useSiteConfig } from '../contexts/SiteConfigContext';

interface StaticPageProps {
  page: {
    title: string;
    content: string;
  };
}

const StaticPage: React.FC<StaticPageProps> = ({ page }) => {
  const { config } = useSiteConfig();
    
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  return (
    <div className="max-w-4xl mx-auto py-8">
      <BackButton />
      <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500 mb-8">
        {page.title}
      </h1>
      <div className="prose prose-invert prose-lg text-gray-300 leading-relaxed space-y-4">
        {page.content.split('\n\n').map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      
      {page.title === "Contact Us" && config.contact && (
        <div className="mt-8 p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
          <div className="space-y-4 text-gray-200">
            <p><strong>Email:</strong> <a href={`mailto:${config.contact.email}`} className="text-green-400 hover:underline">{config.contact.email}</a></p>
            <p><strong>Phone:</strong> <a href={`tel:${config.contact.phone.replace(/\s/g, '')}`} className="text-green-400 hover:underline">{config.contact.phone}</a></p>
            <p><strong>Address:</strong> {config.contact.address}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaticPage;