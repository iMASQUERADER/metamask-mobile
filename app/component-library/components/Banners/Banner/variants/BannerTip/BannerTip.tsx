/* eslint-disable react/prop-types */

// Third party dependencies.
import React from 'react';
import { Image } from 'react-native';

// External dependencies.
import { useStyles } from '../../../../../hooks';
import BannerBase from '../../foundation/BannerBase';

// Internal dependencies.
import styleSheet from './BannerTip.styles';
import { BannerTipProps } from './BannerTip.types';
import {
  DEFAULT_BANNERTIP_LOGOTYPE,
  IMAGESOURCE_BY_BANNERTIPLOGOTYPE,
} from './BannerTip.constants';

const BannerTip: React.FC<BannerTipProps> = ({
  style,
  logoType = DEFAULT_BANNERTIP_LOGOTYPE,
  ...props
}) => {
  const { styles } = useStyles(styleSheet, { style });

  const foxLogo = (
    <Image
      source={IMAGESOURCE_BY_BANNERTIPLOGOTYPE[logoType]}
      style={styles.logo}
      resizeMode={'contain'}
    />
  );

  return <BannerBase style={styles.base} startAccessory={foxLogo} {...props} />;
};

export default BannerTip;