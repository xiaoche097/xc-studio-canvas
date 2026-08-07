import React from 'react';
import SceneGenerationTab from './SceneGenerationTab';

const InstagramSceneTab: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => (
  <SceneGenerationTab isActive={isActive} experience="instagram" />
);

export default InstagramSceneTab;
