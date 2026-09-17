import React from 'react'

const HorizontalPartition = () => {
  return (
    <div>
      {/* divider*/}
        <div className="flex items-center my-6"> 
            
            <div className="flex-1 h-px bg-gray-800"> </div>

            <span className="px-4 text-gray-400">
                    or continue with email
            </span>

            <div className="flex-1 h-px bg-gray-800"> </div>

        </div>
    </div>
  )
}

export default HorizontalPartition
