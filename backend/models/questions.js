// models/questions.js
module.exports = (sequelize, DataTypes) => {
  const Question = sequelize.define('Question', {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      defaultValue: '',
    },
    sample_input: {
      type: DataTypes.TEXT,
      defaultValue: '',
    },
    sample_output: {
      type: DataTypes.TEXT,
      defaultValue: '',
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    faculty_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // NEW FIELDS (language & score). No toggled here because you manage toggles separately.
    language_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 62, // default Judge0 language id (change if you prefer)
    },
    score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
    }
  }, {
    timestamps: true,
    tableName: 'Questions' // keep same table name if your migrations/DB use it
  });

  return Question;
};
