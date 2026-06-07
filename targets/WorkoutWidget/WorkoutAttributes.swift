import ActivityKit
import Foundation

public struct WorkoutAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var exerciseName: String
        public var setNumber: Int
        public var weight: Double
        public var reps: Int
        public var restEndTime: Date?   // nil = not resting, set = countdown to this date
        public var totalSets: Int
    }
    public var workoutName: String
    public var startTime: Date
}
