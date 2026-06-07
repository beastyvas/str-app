import ActivityKit
import WidgetKit
import SwiftUI

// ─── Colours ─────────────────────────────────────────────────────────────────
private let accent = Color(red: 0.91, green: 0.11, blue: 0.47) // #E91E8C

// ─── Lock-screen / StandBy view ──────────────────────────────────────────────
struct WorkoutLockScreenView: View {
    let context: ActivityViewContext<WorkoutAttributes>

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Image(systemName: "dumbbell.fill")
                    .foregroundColor(accent)
                    .font(.system(size: 14, weight: .bold))
                Text(context.attributes.workoutName)
                    .font(.system(size: 15, weight: .heavy))
                    .foregroundColor(.white)
                Spacer()
                // Elapsed time since workout started
                Text(context.attributes.startTime, style: .timer)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundColor(.gray)
                    .monospacedDigit()
            }

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.state.exerciseName)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                    if context.state.weight > 0 {
                        Text("\(Int(context.state.weight)) lbs × \(context.state.reps) reps")
                            .font(.system(size: 11))
                            .foregroundColor(.gray)
                    }
                }
                Spacer()
                if let restEnd = context.state.restEndTime, restEnd > Date() {
                    VStack(alignment: .trailing, spacing: 1) {
                        Text(restEnd, style: .timer)
                            .font(.system(size: 22, weight: .black, design: .monospaced))
                            .foregroundColor(accent)
                            .monospacedDigit()
                        Text("rest")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(.gray)
                            .textCase(.uppercase)
                            .kerning(1)
                    }
                } else {
                    VStack(alignment: .trailing, spacing: 1) {
                        Text("Set \(context.state.setNumber)")
                            .font(.system(size: 20, weight: .black))
                            .foregroundColor(.white)
                        if context.state.totalSets > 0 {
                            Text("of \(context.state.totalSets)")
                                .font(.system(size: 10))
                                .foregroundColor(.gray)
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(Color(red: 0.07, green: 0.07, blue: 0.07))
    }
}

// ─── Widget configuration ─────────────────────────────────────────────────────
struct WorkoutWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutAttributes.self) { context in
            WorkoutLockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded — shown when user long-presses Dynamic Island
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "dumbbell.fill")
                        .foregroundColor(accent)
                        .font(.system(size: 20, weight: .bold))
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if let restEnd = context.state.restEndTime, restEnd > Date() {
                        Text(restEnd, style: .timer)
                            .font(.system(size: 22, weight: .black, design: .monospaced))
                            .foregroundColor(accent)
                            .monospacedDigit()
                            .padding(.trailing, 4)
                    } else {
                        Text("Set \(context.state.setNumber)")
                            .font(.system(size: 18, weight: .black))
                            .foregroundColor(.white)
                            .padding(.trailing, 4)
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(spacing: 2) {
                        Text(context.state.exerciseName)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.white)
                            .lineLimit(1)
                        if context.state.weight > 0 {
                            Text("\(Int(context.state.weight)) × \(context.state.reps)")
                                .font(.system(size: 11))
                                .foregroundColor(.gray)
                        }
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Image(systemName: "timer")
                            .font(.system(size: 11))
                            .foregroundColor(.gray)
                        Text(context.attributes.startTime, style: .timer)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundColor(.gray)
                            .monospacedDigit()
                        Spacer()
                        Text(context.attributes.workoutName)
                            .font(.system(size: 11))
                            .foregroundColor(.gray)
                            .lineLimit(1)
                    }
                    .padding(.horizontal, 8)
                    .padding(.bottom, 4)
                }
            } compactLeading: {
                // Compact — the pill when another app is open
                Image(systemName: "dumbbell.fill")
                    .foregroundColor(accent)
                    .font(.system(size: 12, weight: .bold))
            } compactTrailing: {
                if let restEnd = context.state.restEndTime, restEnd > Date() {
                    Text(restEnd, style: .timer)
                        .font(.system(size: 12, weight: .bold, design: .monospaced))
                        .foregroundColor(accent)
                        .monospacedDigit()
                        .frame(minWidth: 36)
                } else {
                    Text("S\(context.state.setNumber)")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)
                }
            } minimal: {
                Image(systemName: "dumbbell.fill")
                    .foregroundColor(accent)
                    .font(.system(size: 11, weight: .bold))
            }
        }
    }
}

// ─── Bundle ───────────────────────────────────────────────────────────────────
@main
struct WorkoutWidgetBundle: WidgetBundle {
    var body: some Widget {
        WorkoutWidgetLiveActivity()
    }
}
