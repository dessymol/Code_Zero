import React from 'react';

const Skeleton = ({ className, height, width, count = 1, rounded = "rounded-md" }) => {
    const items = Array.from({ length: count });

    return (
        <div className="animate-pulse space-y-3">
            {items.map((_, idx) => (
                <div
                    key={idx}
                    className={`bg-slate-200 ${rounded} ${className}`}
                    style={{
                        height: height || '1em',
                        width: width || '100%',
                    }}
                />
            ))}
        </div>
    );
};

export default Skeleton;
