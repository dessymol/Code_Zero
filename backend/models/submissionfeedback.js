// backend/models/submissionfeedback.js
module.exports = (sequelize, DataTypes) => {
    return sequelize.define('SubmissionFeedback', {
        submission_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
        },
        summary: {
            type: DataTypes.TEXT,
        },
        what_went_wrong: {
            type: DataTypes.TEXT,
        },
        hint: {
            type: DataTypes.TEXT,
        },
        positive: {
            type: DataTypes.TEXT,
        },
        status: {
            type: DataTypes.ENUM('pending', 'done', 'failed'),
            defaultValue: 'pending',
        }
    }, {
        timestamps: true,
        tableName: 'SubmissionFeedbacks'
    });
};
