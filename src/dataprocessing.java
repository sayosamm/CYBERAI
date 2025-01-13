import java.util.*;

public class DataPreprocessing.java {
    public static List<double[]> preprocessNetworkData(List<String> lines) {
        List<double[]> data = new ArrayList<>();
        for (String line : lines) {
            String[] parts = line.split(",");
            double[] row = Arrays.stream(parts).mapToDouble(Double::parseDouble).toArray();
            data.add(row);
        }
        return data;
    }
    @Override
    public String toString() {
        return "DataPreprocessing []";
    }
}

