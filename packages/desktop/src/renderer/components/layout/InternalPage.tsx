import React from 'react';
import { useTranslation } from 'react-i18next';

export interface InternalPageProps {
  routeKey: string;
}

export const InternalPage: React.FC<InternalPageProps> = ({ routeKey }) => {
  const { t } = useTranslation();
  return (
    <div className='p-16px'>
      <div className='text-16px font-medium mb-8px'>{t('common.internalPage.title')}</div>
      <div className='text-12px text-t-secondary'>{routeKey}</div>
    </div>
  );
};
