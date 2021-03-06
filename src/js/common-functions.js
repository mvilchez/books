import moment from "moment";

function sortArrayByField(array, dateField) {
  return array.slice(0).sort((a, b) => {
    return (
      moment(a[dateField], "DD/MM/YYYY") - moment(b[dateField], "DD/MM/YYYY")
    );
  });
}

export default sortArrayByField;
