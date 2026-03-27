function DeceasedInfo({ dedication }) {
  if (!dedication || !dedication.dedicated || dedication.dedicated.length === 0) {
    return (
      <div className="dedication-box">
        <div className="label">ختمة هذه الدورة</div>
        <div className="deceased-name">لم يتم تحديد إهداء</div>
      </div>
    );
  }

  const { dedicated, hasAnniversary, anniversaryPeople } = dedication;

  return (
    <div className={`dedication-box ${hasAnniversary ? 'anniversary' : ''}`}>
      <div className="label">
        {hasAnniversary ? 'ذكرى وفاة — ' : ''}ختمة هذه الدورة مهداة لروح
      </div>

      {dedicated.map((person, i) => {
        const deathDate = new Date(person.death_date).toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const isAnniversary = anniversaryPeople?.some(
          ap => ap._id === person._id
        );

        return (
          <div key={person._id || i} className="deceased-entry">
            <div className="deceased-name">
              {person.name}
              {isAnniversary && <span className="anniversary-tag"> (ذكرى وفاة)</span>}
            </div>
            <div className="death-date">تاريخ الوفاة: {deathDate}</div>
            {i < dedicated.length - 1 && <div className="deceased-separator">و</div>}
          </div>
        );
      })}
    </div>
  );
}

export default DeceasedInfo;
