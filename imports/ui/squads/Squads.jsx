import React from 'react';
import SquadsCollection from '../../api/collections/squads.collection';
import Section from '../section/Section';
import SquadsForm from './SquadsForm';
import getSquadsColumns from './squads.columns';

export default function Squads() {
  return (
    <Section title="Squads" collectionName="squads" Collection={SquadsCollection} FormComponent={SquadsForm} columnsFactory={getSquadsColumns} />
  );
}
