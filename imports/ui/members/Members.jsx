import React, { useCallback } from 'react';
import MembersCollection from '../../api/collections/members.collection';
import Section from '../section/Section';
import MemberForm from './MemberForm';
import getMembersColumns from './members.columns';

export default function Members() {
  const filterFactory = useCallback(
    string => ({
      $or: [
        { username: { $regex: string, $options: 'i' } },
        { 'profile.name': { $regex: string, $options: 'i' } },
        { 'profile.id': { $regex: string, $options: 'i' } },
        { 'profile.discordTag': { $regex: string, $options: 'i' } },
      ],
    }),
    []
  );

  return (
    <Section
      title="Members"
      collectionName="members"
      Collection={MembersCollection}
      FormComponent={MemberForm}
      columnsFactory={getMembersColumns}
      filterFactory={filterFactory}
    />
  );
}
