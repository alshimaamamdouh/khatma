function DeceasedInfo({ dedication }) {
  if (!dedication || !dedication.dedicated) {
    return (
      <div className="dedication-box">
        <div className="label">ختمة هذا الأسبوع</div>
        <div className="deceased-name">لم يتم تحديد إهداء</div>
      </div>
    );
  }

  const { dedicated, isAnniversary, anniversaryPerson } = dedication;
  const deathDate = new Date(dedicated.death_date).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className={`dedication-box ${isAnniversary ? 'anniversary' : ''}`}>
      <div className="label">
        {isAnniversary ? 'ذكرى وفاة - ختمة هذا الأسبوع مهداة لروح' : 'ختمة هذا الأسبوع مهداة لروح'}
      </div>
      <div className="deceased-name">{dedicated.name}</div>
      <div className="death-date">تاريخ الوفاة: {deathDate}</div>
      {anniversaryPerson && !isAnniversary && (
        <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#c62828' }}>
          ذكرى وفاة: {anniversaryPerson.name}
        </div>
      )}
    </div>
  );
}

export default DeceasedInfo;
